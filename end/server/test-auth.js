const base = 'http://localhost:3000';

async function main() {
  const unique = 'verify401_' + Date.now();
  const signupRes = await fetch(base + '/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: unique, password: 'Verify401pass!' }),
    credentials: 'include'
  });

  const signupText = await signupRes.text();
  const setCookie = signupRes.headers.get('set-cookie');
  console.log('SIGNUP_STATUS=' + signupRes.status);
  console.log('SIGNUP_BODY=' + signupText);
  console.log('SET_COOKIE=' + (setCookie || '')); 

  const cookie = setCookie ? setCookie.split(';')[0] : '';
  const meRes = await fetch(base + '/api/auth/me', {
    method: 'GET',
    headers: cookie ? { cookie } : {},
    credentials: 'include'
  });
  const meText = await meRes.text();
  console.log('ME_STATUS=' + meRes.status);
  console.log('ME_BODY=' + meText);
}

main().catch((err) => {
  console.error('TEST_ERROR', err);
  process.exit(1);
});
