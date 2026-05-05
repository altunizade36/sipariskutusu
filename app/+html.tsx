import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <ScrollViewStyleReset />

        {/*
          color-scheme: light — tarayıcının kendi karanlık mod algoritmasının
          görüntülere filtre (renk tersine çevirme vb.) uygulamasını engeller.
          Uygulamanın kendi karanlık modu AuthContext isDarkMode ile yönetilir.
        */}
        <style dangerouslySetInnerHTML={{ __html: baseStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const baseStyles = `
:root {
  color-scheme: light;
}
body {
  background-color: #fff;
}`;
