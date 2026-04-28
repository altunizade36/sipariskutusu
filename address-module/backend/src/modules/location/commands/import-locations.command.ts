import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { LocationImportService } from '../services/location-import.service';

interface ImportLocationsOptions {
  sourceName: string;
  filePath: string;
}

@Injectable()
@Command({
  name: 'import:locations',
  description: 'Import official or enterprise location CSV into hierarchical location tables',
})
export class ImportLocationsCommand extends CommandRunner {
  constructor(private readonly locationImportService: LocationImportService) {
    super();
  }

  async run(_: string[], options: ImportLocationsOptions): Promise<void> {
    const result = await this.locationImportService.importCsv(options.sourceName, options.filePath);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          source: result.sourceName,
          status: result.status,
          totalRows: result.totalRows,
          insertedRows: result.insertedRows,
          failedRows: result.failedRows,
        },
        null,
        2,
      ),
    );
  }

  @Option({ flags: '--source [sourceName]', required: true, description: 'Source name, e.g. MAKS_2026_04' })
  parseSourceName(val: string): string {
    return val;
  }

  @Option({ flags: '--file [filePath]', required: true, description: 'CSV file path' })
  parseFilePath(val: string): string {
    return val;
  }
}
