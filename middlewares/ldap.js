const ldap = require('ldapjs');

const LDAP_URL = process.env.LDAP_URL;
const LDAP_BASE_DN = process.env.LDAP_BASE_DN;

const authenticateLDAP = (email, password) => {
  const client = ldap.createClient({ url: LDAP_URL });

  return new Promise((resolve) => {
    const opts = {
      filter: `(mail=${email})`,
      scope: 'sub',
      attributes: ['dn', 'cn', 'mail'],
    };

    client.search(LDAP_BASE_DN, opts, (err, res) => {
      if (err) {
        client.unbind();
        console.warn('LDAP search error:', err.message);
        return resolve(null); // silent fail
      }

      let userDn = null;

      res.on('searchEntry', (entry) => {
        userDn = entry.dn.toString();
      });

      res.on('error', (err) => {
        client.unbind();
        console.warn('LDAP search entry error:', err.message);
        return resolve(null);
      });

      res.on('end', () => {
        if (!userDn) {
          client.unbind();
          console.warn('LDAP: Email tidak ditemukan');
          return resolve(null);
        }

        client.bind(userDn, password, (err) => {
          client.unbind();
          if (err) {
            console.warn('LDAP bind gagal:', err.message);
            return resolve(null);
          }

          return resolve({
            success: true,
            message: 'Autentikasi berhasil',
            dn: userDn,
          });
        });
      });
    });
  });
};

module.exports = { authenticateLDAP };
