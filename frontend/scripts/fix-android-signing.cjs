/**
 * One-off: point com.atomikaudio.service at the Play-registered upload keystore (SHA1 6E:F4:E9...).
 * Run from frontend/: node scripts/fix-android-signing.cjs
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const EAS_CLI = path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'eas-cli');
const { createGraphqlClient } = require(path.join(EAS_CLI, 'build/commandUtils/context/contextUtils/createGraphqlClient'));
const GraphqlClient = require(path.join(EAS_CLI, 'build/credentials/android/api/GraphqlClient'));

const PLAY_SHA1 = '6E:F4:E9:10:FD:91:87:DC:AD:86:7C:16:1F:E5:E6:82:5A:5B:B6:9E';
const PROJECT = { account: { name: 'atomikaudio' }, projectName: 'atomik-audio' };
const SERVICE_PACKAGE = 'com.atomikaudio.service';
const APP_PACKAGE = 'com.atomikaudio.app';

function loadSessionSecret() {
  const statePath = path.join(os.homedir(), '.expo', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (!state.auth?.sessionSecret) {
    throw new Error('Not logged in to Expo. Run: eas login');
  }
  return state.auth.sessionSecret;
}

function normalizeSha1(fp) {
  return String(fp || '').toUpperCase().replace(/[^0-9A-F]/g, '');
}

function collectKeystores(buildCredentialsList) {
  const out = [];
  for (const bc of buildCredentialsList) {
    const ks = bc.androidKeystore;
    if (!ks) continue;
    out.push({
      buildCredentialsId: bc.id,
      buildCredentialsName: bc.name,
      isDefault: bc.isDefault,
      keystoreId: ks.id,
      sha1: ks.sha1CertificateFingerprint,
      alias: ks.keyAlias,
    });
  }
  return out;
}

async function main() {
  const graphqlClient = createGraphqlClient({ sessionSecret: loadSessionSecret() });

  const appLookup = (androidApplicationIdentifier) => ({
    ...PROJECT,
    androidApplicationIdentifier,
  });

  const serviceCreds = await GraphqlClient.getAndroidAppBuildCredentialsListAsync(
    graphqlClient,
    appLookup(SERVICE_PACKAGE)
  );
  const appCreds = await GraphqlClient.getAndroidAppBuildCredentialsListAsync(
    graphqlClient,
    appLookup(APP_PACKAGE)
  );

  const all = [...collectKeystores(appCreds), ...collectKeystores(serviceCreds)];
  console.log('Known keystores:');
  for (const k of all) {
    console.log(`  - ${k.buildCredentialsName} (${k.isDefault ? 'default' : 'non-default'}) SHA1=${k.sha1}`);
  }

  const playKeystore = all.find((k) => normalizeSha1(k.sha1) === normalizeSha1(PLAY_SHA1));
  if (!playKeystore) {
    throw new Error(`Keystore with Play SHA1 ${PLAY_SHA1} not found in Expo credentials.`);
  }

  const serviceDefault =
    serviceCreds.find((bc) => bc.isDefault) ?? serviceCreds[0];

  if (!serviceDefault) {
    throw new Error(`No build credentials for ${SERVICE_PACKAGE}`);
  }

  const currentSha1 = serviceDefault.androidKeystore?.sha1CertificateFingerprint;
  if (normalizeSha1(currentSha1) === normalizeSha1(PLAY_SHA1)) {
    console.log('Service package already uses the Play-registered keystore. No change needed.');
    return;
  }

  console.log(`\nUpdating "${serviceDefault.name}" on ${SERVICE_PACKAGE} to keystore ${playKeystore.keystoreId}...`);
  await GraphqlClient.updateAndroidAppBuildCredentialsAsync(graphqlClient, serviceDefault, {
    androidKeystoreId: playKeystore.keystoreId,
  });
  await GraphqlClient.setDefaultAndroidAppBuildCredentialsAsync(graphqlClient, serviceDefault);

  const verify = await GraphqlClient.getDefaultAndroidAppBuildCredentialsAsync(
    graphqlClient,
    appLookup(SERVICE_PACKAGE)
  );
  const newSha1 = verify?.androidKeystore?.sha1CertificateFingerprint;
  console.log(`Done. Default keystore SHA1 is now: ${newSha1}`);
  if (normalizeSha1(newSha1) !== normalizeSha1(PLAY_SHA1)) {
    throw new Error('Verification failed — keystore was not updated.');
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
