import { createRemoteJWKSet, jwtVerify } from 'jose'

// Google signs ID tokens with these public keys. jose caches them and handles rotation.
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 10_000 })

export async function verifyGoogleIdentity(idToken: string, clientId: string, nonce: string): Promise<string> {
  if (idToken.length > 16_384) throw new Error('Invalid Google identity')
  const { payload } = await jwtVerify(idToken, googleKeys, {
    algorithms: ['RS256'], audience: clientId,
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    requiredClaims: ['exp', 'iat', 'sub', 'email', 'email_verified', 'nonce'],
  })
  if (payload.nonce !== nonce || payload.email_verified !== true || typeof payload.email !== 'string' || payload.email.length > 320 || !payload.email.includes('@')) throw new Error('Invalid Google identity')
  return payload.email
}
