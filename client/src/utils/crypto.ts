// Client-side RSA utilities using Web Crypto (RSA-OAEP with SHA-256)
// Exports helpers to generate key pair, export/import PEM, encrypt and decrypt.

/* eslint-disable no-undef */

const subtle = window.crypto.subtle;

// Convert ArrayBuffer to base64
const abToBase64 = (buf) => {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
};

// Convert base64 to ArrayBuffer
const base64ToAb = (base64) => {
	const binary = window.atob(base64);
	const len = binary.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
};

// PEM helpers
const arrayBufferToPem = (buffer, type) => {
	const b64 = abToBase64(buffer);
	const chunkSize = 64;
	const chunks = [];
	for (let i = 0; i < b64.length; i += chunkSize) {
		chunks.push(b64.slice(i, i + chunkSize));
	}
	const pem = `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----`;
	return pem;
};

const pemToArrayBuffer = (pem) => {
	const b64 = pem.replace(/-----BEGIN [^-]+-----/, '')
								 .replace(/-----END [^-]+-----/, '')
								 .replace(/\r?\n|\r/g, '');
	return base64ToAb(b64);
};

export const generateKeyPair = async () => {
	const keyPair = await subtle.generateKey(
		{
			name: 'RSA-OAEP',
			modulusLength: 2048,
			publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
			hash: 'SHA-256'
		},
		true,
		['encrypt', 'decrypt']
	);

	const publicKeySpki = await subtle.exportKey('spki', keyPair.publicKey);
	const privateKeyPkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey);

	const publicKeyPem = arrayBufferToPem(publicKeySpki, 'PUBLIC KEY');
	const privateKeyPem = arrayBufferToPem(privateKeyPkcs8, 'PRIVATE KEY');

	// Also export private key as JWK for easy re-import
	const privateKeyJwk = await subtle.exportKey('jwk', keyPair.privateKey);

	return { publicKeyPem, privateKeyPem, privateKeyJwk };
};

export const importPublicKeyFromPem = async (pem) => {
	const ab = pemToArrayBuffer(pem);
	return await subtle.importKey('spki', ab, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
};

export const importPrivateKeyFromJwk = async (jwk) => {
	return await subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
};

export const encryptWithPublicKeyPem = async (publicKeyPem, message) => {
	const pubKey = await importPublicKeyFromPem(publicKeyPem);
	const enc = new TextEncoder().encode(message);
	const ciphertext = await subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, enc);
	return abToBase64(ciphertext);
};

export const decryptWithPrivateKeyJwk = async (privateKeyJwk, base64Ciphertext) => {
	const privateKey = await importPrivateKeyFromJwk(privateKeyJwk);
	const ciphertext = base64ToAb(base64Ciphertext);
	const plainBuf = await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, ciphertext);
	return new TextDecoder().decode(plainBuf);
};

export default {
	generateKeyPair,
	encryptWithPublicKeyPem,
	decryptWithPrivateKeyJwk,
};