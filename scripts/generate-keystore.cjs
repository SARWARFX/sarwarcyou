const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

console.log('Generating 2048-bit RSA key pair...');
const keys = forge.pki.rsa.generateKeyPair(2048);

console.log('Creating self-signed X.509 certificate...');
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(16));

cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + 10000);

const attrs = [
  { name: 'commonName', value: 'SARWARCYOU' },
  { name: 'organizationalUnitName', value: 'Mobile' },
  { name: 'organizationName', value: 'SarwarFX' },
  { name: 'localityName', value: 'Rajshahi' },
  { name: 'countryName', value: 'BD' }
];

cert.setSubject(attrs);
cert.setIssuer(attrs);

cert.setExtensions([
  {
    name: 'basicConstraints',
    cA: true
  },
  {
    name: 'keyUsage',
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
  }
]);

// Self-sign certificate using SHA-256
cert.sign(keys.privateKey, forge.md.sha256.create());

console.log('Packaging into PKCS#12 keystore (compatible with Android apksigner / JKS)...');
const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
  keys.privateKey,
  [cert],
  'SarwarVaultKey2026',
  {
    friendlyName: 'sarwarcyou',
    algorithm: '3des'
  }
);

const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
const p12Buffer = Buffer.from(p12Der, 'binary');

const keystorePath = path.join(__dirname, '..', 'release-key.jks');
fs.writeFileSync(keystorePath, p12Buffer);
console.log(`Saved keystore to: ${keystorePath} (${p12Buffer.length} bytes)`);

const base64Str = p12Buffer.toString('base64');
const base64Path = path.join(__dirname, '..', 'KEYSTORE_BASE64_FOR_GITHUB.txt');
fs.writeFileSync(base64Path, base64Str, 'utf8');
console.log(`Saved Base64 secret to: ${base64Path} (${base64Str.length} chars)`);
