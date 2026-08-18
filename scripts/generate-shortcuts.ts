/**
 * Generates Apple Shortcuts .shortcut plist files for each supported bank.
 * Each file, when imported into the iOS Shortcuts app and wired to a Personal
 * Automation (notification from the bank's app), forwards notification content
 * to FinWiz via the finwiz:// URL scheme.
 *
 * Usage:
 *   npx ts-node scripts/generate-shortcuts.ts
 *
 * Output: apps/mobile/assets/shortcuts/<BankName>.shortcut
 *
 * After importing a shortcut, the user must replace four placeholder values
 * with magic variables from the Automation trigger (guided in M11 onboarding):
 *   NOTIFICATION_TITLE → Notification Title  (from the trigger)
 *   NOTIFICATION_BODY  → Notification Body   (from the trigger)
 *   UNIX_TIMESTAMP_MS  → Format Date action  (format string "x" = Unix ms)
 *   HMAC_KEY           → Key shown in FinWiz Settings → Vault Connection
 */

import * as fs from 'fs';
import * as path from 'path';

interface BankDefinition {
  readonly displayName: string;
  readonly appPackage: string;
}

const BANKS: BankDefinition[] = [
  { displayName: 'Nubank',    appPackage: 'com.nu.production' },
  { displayName: 'Inter',     appPackage: 'br.com.intermedium' },
  { displayName: 'Itau',      appPackage: 'com.itau' },
  { displayName: 'Bradesco',  appPackage: 'com.bradesco' },
  { displayName: 'C6Bank',    appPackage: 'com.c6bank.app' },
  { displayName: 'Santander', appPackage: 'br.com.santander.benvisavale' },
];

// URL params must be XML-escaped (& → &amp;) inside the plist string value.
function buildIngestUrl(appPackage: string): string {
  return (
    'finwiz://ingest' +
    `?bank=${appPackage}` +
    '&amp;title=NOTIFICATION_TITLE' +
    '&amp;body=NOTIFICATION_BODY' +
    '&amp;ts=UNIX_TIMESTAMP_MS' +
    '&amp;hmac=HMAC_KEY'
  );
}

function buildPlist(displayName: string, appPackage: string): string {
  const ingestUrl = buildIngestUrl(appPackage);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>WFWorkflowActions</key>
\t<array>
\t\t<!--
\t\t  Open FinWiz with the banking notification encoded in the URL.
\t\t  Set up a Personal Automation in Shortcuts (Notification from ${displayName})
\t\t  and replace the four PLACEHOLDER values with magic variables:
\t\t    NOTIFICATION_TITLE → Notification Title   (Automation trigger variable)
\t\t    NOTIFICATION_BODY  → Notification Body    (Automation trigger variable)
\t\t    UNIX_TIMESTAMP_MS  → Format Date (format: x) action output
\t\t    HMAC_KEY           → Key shown in FinWiz Settings › Vault Connection
\t\t-->
\t\t<dict>
\t\t\t<key>WFWorkflowActionIdentifier</key>
\t\t\t<string>is.workflow.actions.openurl</string>
\t\t\t<key>WFWorkflowActionParameters</key>
\t\t\t<dict>
\t\t\t\t<key>WFInput</key>
\t\t\t\t<dict>
\t\t\t\t\t<key>Value</key>
\t\t\t\t\t<dict>
\t\t\t\t\t\t<key>attachmentsByRange</key>
\t\t\t\t\t\t<dict/>
\t\t\t\t\t\t<key>string</key>
\t\t\t\t\t\t<string>${ingestUrl}</string>
\t\t\t\t\t</dict>
\t\t\t\t\t<key>WFSerializationType</key>
\t\t\t\t\t<string>WFTextTokenString</string>
\t\t\t\t</dict>
\t\t\t\t<key>Show-HideResult</key>
\t\t\t\t<false/>
\t\t\t</dict>
\t\t</dict>
\t</array>
\t<key>WFWorkflowClientVersion</key>
\t<string>1165</string>
\t<key>WFWorkflowHasShortcutInputVariables</key>
\t<true/>
\t<key>WFWorkflowIcon</key>
\t<dict>
\t\t<key>WFWorkflowIconGlyphNumber</key>
\t\t<integer>59506</integer>
\t\t<key>WFWorkflowIconStartColor</key>
\t\t<integer>463140863</integer>
\t</dict>
\t<key>WFWorkflowImportQuestions</key>
\t<array/>
\t<key>WFWorkflowInputContentItemClasses</key>
\t<array/>
\t<key>WFWorkflowMinimumClientVersion</key>
\t<integer>900</integer>
\t<key>WFWorkflowName</key>
\t<string>FinWiz – ${displayName}</string>
\t<key>WFWorkflowOutputContentItemClasses</key>
\t<array/>
\t<key>WFWorkflowTypes</key>
\t<array/>
</dict>
</plist>`;
}

const outDir = path.resolve(__dirname, '../apps/mobile/assets/shortcuts');
fs.mkdirSync(outDir, { recursive: true });

for (const { displayName, appPackage } of BANKS) {
  const content = buildPlist(displayName, appPackage);
  const filePath = path.join(outDir, `${displayName}.shortcut`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ${displayName}.shortcut`);
}

console.log(`\nGenerated ${BANKS.length} shortcut files in ${outDir}`);
