// scripts/createSipTables.js
require('dotenv').config();
const db = require('../config/database');

async function createSipTables() {
  try {
    // Create sip_peers table
    await db.query(`
        CREATE TABLE yovo_tbl_aiqa_groups (
          id INT(11) NOT NULL AUTO_INCREMENT,
          name VARCHAR(50) NOT NULL,
          description TEXT,
          permissions JSON DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY name (name)
        ) ENGINE=INNODB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1
      )
    `);

    // Create global_settings table
    await db.query(`
      CREATE TABLE yovo_tbl_aiqa_users_groups (
        user_id INT(11) NOT NULL,
        group_id INT(11) NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id,group_id),
        KEY group_id (group_id)
      ) ENGINE=INNODB DEFAULT CHARSET=latin1
    `);

    await db.query(`
      CREATE TABLE yovo_tbl_password_history (
        id int(11) NOT NULL AUTO_INCREMENT,
        user_id int(11) NOT NULL,
        password_hash varchar(255) NOT NULL,
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
    `);

    await db.query(`
      CREATE TABLE yovo_tbl_token_blacklist (
        token_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        PRIMARY KEY (token_id),
        KEY idx_expires (expires_at)
      ) ENGINE=INNODB DEFAULT CHARSET=latin1
    `);

    await db.query(`
      CREATE TABLE yovo_tbl_user_logins (
        id int(11) NOT NULL AUTO_INCREMENT,
        user_id int(11) NOT NULL,
        token_id varchar(255) NOT NULL,
        fingerprint varchar(255) DEFAULT NULL,
        ip_address varchar(45) DEFAULT NULL,
        user_agent text,
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at timestamp NOT NULL,
        is_revoked tinyint(1) DEFAULT '0',
        PRIMARY KEY (id),
        KEY idx_token (token_id),
        KEY idx_user_token (user_id,token_id)
      ) ENGINE=InnoDB AUTO_INCREMENT=160 DEFAULT CHARSET=latin1
    `);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating SIP tables:', error);
    process.exit(1);
  }
}

createSipTables();