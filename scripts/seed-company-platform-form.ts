import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  buildCompanyCreatePlatformTableColumns,
  COMPANY_CREATE_PLATFORM_BASELINE_FIELDS,
} from '../src/forms/seed/company-create-platform-baseline';
import { FormsRepository } from '../src/forms/forms.repository';
import { validateFormFieldSchema } from '../src/forms/validation/field-schema.validator';
import { validateFormTableColumnSchema } from '../src/forms/validation/table-column-schema.validator';

const COMPANY_CREATE_FORM_KEY = 'crm.company.create';

async function seedCompanyPlatformForm(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const formsRepository = app.get(FormsRepository);

    const fields = validateFormFieldSchema(
      COMPANY_CREATE_PLATFORM_BASELINE_FIELDS,
    );
    const tableColumns = validateFormTableColumnSchema(
      buildCompanyCreatePlatformTableColumns(fields),
      { requireEmailColumn: false },
    );

    let platform = await formsRepository.findPlatformSchema(
      COMPANY_CREATE_FORM_KEY,
    );

    if (!platform) {
      platform = formsRepository.createSchema(
        COMPANY_CREATE_FORM_KEY,
        null,
        {
          fields,
          tableColumns,
          steps: null,
          layout: null,
          version: 1,
        },
      );
    } else {
      platform.fields = fields;
      platform.publishedFields = fields;
      platform.tableColumns = tableColumns;
      platform.publishedTableColumns = tableColumns;
      platform.steps = null;
      platform.publishedSteps = null;
      platform.layout = null;
      platform.publishedLayout = null;
      platform.version = platform.version + 1;
      platform.publishedVersion = platform.publishedVersion + 1;
    }

    await formsRepository.saveSchema(platform);

    const orgExtensions = await formsRepository.findOrgExtensionsByFormKey(
      COMPANY_CREATE_FORM_KEY,
    );

    for (const extension of orgExtensions) {
      extension.fields = [];
      extension.tableColumns = [];
      extension.steps = null;
      extension.layout = null;
      await formsRepository.saveSchema(extension);
    }

    console.log(
      `Seeded platform ${COMPANY_CREATE_FORM_KEY}: ${fields.length} fields (draft + published synced), ${tableColumns.length} table columns.`,
    );
    console.log(
      `Cleared org extensions for ${orgExtensions.length} organization(s).`,
    );
    console.log(
      'Hard-refresh CRM Companies + Platform form editor, then test save/publish flow.',
    );
  } finally {
    await app.close();
  }
}

void seedCompanyPlatformForm().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
