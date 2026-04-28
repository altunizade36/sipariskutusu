#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const root = process.cwd();
const envPath = path.join(root, ".env");

function parseArgs(argv) {
  const args = {
    projectRef: "",
    setSecrets: true,
    deployFunctions: true,
    checkOnly: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--project-ref") {
      args.projectRef = argv[i + 1] || "";
      i += 1;
    } else if (current === "--no-set-secrets") {
      args.setSecrets = false;
    } else if (current === "--no-deploy-functions") {
      args.deployFunctions = false;
    } else if (current === "--check-only") {
      args.checkOnly = true;
    }
  }

  return args;
}

function parseEnvFile(content) {
  const map = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    map[key] = value;
  }

  return map;
}

function upsertEnvValue(filePath, key, value) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = current.split(/\r?\n/);
  let found = false;

  const nextLines = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    nextLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, nextLines.join('\n'));
}

function deriveSupabaseUrlFromDatabaseUrl(databaseUrl) {
  if (!databaseUrl || isPlaceholder(databaseUrl)) {
    return '';
  }

  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname || '';
    const match = host.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
    if (!match) {
      return '';
    }

    const projectRef = match[1];
    return `https://${projectRef}.supabase.co`;
  } catch {
    return '';
  }
}

function isPlaceholder(value) {
  if (!value) {
    return true;
  }

  const v = value.toLowerCase();
  return (
    v.includes("proje_id") ||
    v.includes("xxxx") ||
    v.includes("xxx") ||
    v.includes("...") ||
    v.includes("example") ||
    v.includes("your_") ||
    v.includes("placeholder")
  );
}

function mask(value) {
  if (!value) {
    return "(bos)";
  }

  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: true,
    stdio: "ignore",
  });

  return result.status === 0;
}

function run(command, args, title) {
  console.log(`\n> ${title}`);
  const result = spawnSync(command, args, {
    cwd: root,
    shell: true,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${title} basarisiz oldu.`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("\nSiparisKutusu altyapi otomasyonu basladi...\n");

  if (!fs.existsSync(envPath)) {
    const envExamplePath = path.join(root, ".env.example");
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log(".env bulunamadi, .env.example kopyalanarak otomatik olusturuldu.");
      console.log("Devam etmek icin Supabase keylerini .env dosyasina girmeniz gerekiyor.");
    } else {
      console.error(".env ve .env.example bulunamadi. Ortam degiskenleri olusturulamadi.");
      process.exit(1);
    }
  }

  const env = parseEnvFile(fs.readFileSync(envPath, "utf8"));

  if (!env.EXPO_PUBLIC_SUPABASE_URL || isPlaceholder(env.EXPO_PUBLIC_SUPABASE_URL)) {
    const derivedSupabaseUrl = deriveSupabaseUrlFromDatabaseUrl(env.DATABASE_URL || '');
    if (derivedSupabaseUrl) {
      upsertEnvValue(envPath, 'EXPO_PUBLIC_SUPABASE_URL', derivedSupabaseUrl);
      env.EXPO_PUBLIC_SUPABASE_URL = derivedSupabaseUrl;
      console.log(`EXPO_PUBLIC_SUPABASE_URL otomatik turetildi: ${derivedSupabaseUrl}`);
    }
  }

  const requiredClientKeys = [
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  ];

  const optionalClientKeys = [
    "EXPO_PUBLIC_META_APP_ID",
    "EXPO_PUBLIC_SENTRY_DSN",
    "EXPO_PUBLIC_POSTHOG_API_KEY",
  ];

  const requiredSecretKeys = [
    "META_APP_ID",
    "META_APP_SECRET",
  ];

  const optionalNotificationSecretKeys = [
    "FCM_SERVER_KEY",
    "SMS_API_URL",
    "SMS_API_KEY",
    "SMS_SENDER_ID",
    "SENDGRID_API_KEY",
    "EMAIL_FROM_ADDRESS",
    "EMAIL_FROM_NAME",
  ];

  let hasError = false;

  console.log("[1/4] .env kontrolu");

  for (const key of requiredClientKeys) {
    const value = env[key];
    if (!value || isPlaceholder(value)) {
      hasError = true;
      console.error(`- Eksik/Zayif: ${key}`);
    } else {
      console.log(`- OK: ${key} = ${mask(value)}`);
    }
  }

  for (const key of optionalClientKeys) {
    const value = env[key];
    if (value && !isPlaceholder(value)) {
      console.log(`- Opsiyonel aktif: ${key} = ${mask(value)}`);
    } else {
      console.log(`- Opsiyonel bos: ${key}`);
    }
  }

  const migrationsDir = path.join(root, "supabase", "migrations");
  const migrationFiles = fs.existsSync(migrationsDir)
    ? fs
        .readdirSync(migrationsDir)
        .filter((name) => name.toLowerCase().endsWith(".sql"))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => path.join(migrationsDir, name))
    : [];

  const fnSendPush = path.join(root, "supabase", "functions", "send-push", "index.ts");
  const fnDispatchNotification = path.join(root, "supabase", "functions", "dispatch-notification", "index.ts");
  const fnProcessPayment = path.join(root, "supabase", "functions", "process-payment", "index.ts");

  console.log("\n[2/4] Dosya kontrolu");

  const filesToCheck = [
    ...migrationFiles,
    fnSendPush,
    fnDispatchNotification,
    fnProcessPayment,
  ];

  for (const file of filesToCheck) {
    if (!fs.existsSync(file)) {
      hasError = true;
      console.error(`- Eksik dosya: ${path.relative(root, file)}`);
    } else {
      console.log(`- OK: ${path.relative(root, file)}`);
    }
  }

  if (hasError) {
    console.error("\nAltyapi kontrolu basarisiz. Zorunlu Supabase anahtarlari eksik veya placeholder durumda.");
    console.error("- Gerekli: EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY");
    console.error("- Sonraki adim: npm run infra:check");
    process.exit(1);
  }

  if (migrationFiles.length === 0) {
    console.error("\nMigration klasorunde SQL dosyasi bulunamadi.");
    process.exit(1);
  }

  console.log("\n[3/4] Bilgi");
  console.log(`- SQL migration dosyalari Supabase SQL Editor'da sirayla calistirilmali: ${migrationFiles
    .map((file) => path.basename(file))
    .join(" -> ")}`);

  if (args.checkOnly) {
    console.log("\nSadece kontrol modu tamamlandi.");
    return;
  }

  if (!args.projectRef || isPlaceholder(args.projectRef)) {
    console.log("\nProject ref verilmedigi icin deploy asamalari atlandi.");
    console.log("Calistirmak icin: npm run infra:auto -- --project-ref YOUR_PROJECT_REF");
    return;
  }

  if (!commandExists("npx", ["supabase", "--version"])) {
    console.error("Supabase CLI bulunamadi. npx supabase --version komutu calismiyor.");
    process.exit(1);
  }

  run("npx", ["supabase", "link", "--project-ref", args.projectRef], "Supabase proje linkleme");

  if (args.setSecrets) {
    console.log("\n[4/4] Secret ayarlari");

    const secretPairs = [];

    const metaAppId = env.META_APP_ID || env.EXPO_PUBLIC_META_APP_ID;
    if (metaAppId && !isPlaceholder(metaAppId)) {
      secretPairs.push(`META_APP_ID=${metaAppId}`);
    }

    const metaAppSecret = env.META_APP_SECRET;
    if (metaAppSecret && !isPlaceholder(metaAppSecret)) {
      secretPairs.push(`META_APP_SECRET=${metaAppSecret}`);
    }

    for (const key of optionalNotificationSecretKeys) {
      const value = env[key];
      if (value && !isPlaceholder(value)) {
        secretPairs.push(`${key}=${value}`);
      }
    }

    if (secretPairs.length > 0) {
      run(
        "npx",
        ["supabase", "secrets", "set", ...secretPairs, "--project-ref", args.projectRef],
        "Supabase secrets set"
      );
    } else {
      console.log("- Secret degeri bulunamadi. Bu adim atlandi.");
    }

    for (const key of requiredSecretKeys) {
      const value = env[key] || (key === "META_APP_ID" ? env.EXPO_PUBLIC_META_APP_ID : "");
      if (!value || isPlaceholder(value)) {
        console.log(`- Uyari: ${key} eksik, ilgili Edge Function runtime'da hata verebilir.`);
      }
    }

    for (const key of optionalNotificationSecretKeys) {
      const value = env[key];
      if (!value || isPlaceholder(value)) {
        console.log(`- Bilgi: ${key} bos/gecersiz. Ilgili kanal etkin degilse bu normaldir.`);
      }
    }
  }

  if (args.deployFunctions) {

    run(
      "npx",
      ["supabase", "functions", "deploy", "send-push", "--project-ref", args.projectRef],
      "send-push deploy"
    );

    run(
      "npx",
      ["supabase", "functions", "deploy", "dispatch-notification", "--project-ref", args.projectRef],
      "dispatch-notification deploy"
    );

    run(
      "npx",
      ["supabase", "functions", "deploy", "process-payment", "--project-ref", args.projectRef],
      "process-payment deploy"
    );
  }

  console.log("\nAltyapi otomasyonu tamamlandi.");
  console.log("Sonraki adim: npm run start ile uygulamayi acin.");
}

try {
  main();
} catch (error) {
  console.error("\nHata:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}


