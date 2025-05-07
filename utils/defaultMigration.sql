/*
SQLyog Ultimate v13.1.1 (64 bit)
MySQL - 8.0.34 : Database - yovo_db_cc
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`yovo_db_cc` /*!40100 DEFAULT CHARACTER SET latin1 */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `yovo_db_cc`;

/*Table structure for table `yovo_tbl_aiqa_credit_transactions` */

DROP TABLE IF EXISTS `yovo_tbl_aiqa_credit_transactions`;

CREATE TABLE `yovo_tbl_aiqa_credit_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,2) NOT NULL,
  `transaction_type` enum('deduction','addition') NOT NULL,
  `evaluation_id` varchar(36) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `balance_after` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

/*Data for the table `yovo_tbl_aiqa_credit_transactions` */

/*Table structure for table `yovo_tbl_aiqa_credits` */

DROP TABLE IF EXISTS `yovo_tbl_aiqa_credits`;

CREATE TABLE `yovo_tbl_aiqa_credits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `current_balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `low_balance_threshold` int NOT NULL DEFAULT '20',
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;

/*Data for the table `yovo_tbl_aiqa_credits` */

insert  into `yovo_tbl_aiqa_credits`(`id`,`current_balance`,`low_balance_threshold`,`last_updated`) values 
(1,100.00,20,'2025-04-28 18:58:55');

/*Table structure for table `yovo_tbl_aiqa_groups` */

DROP TABLE IF EXISTS `yovo_tbl_aiqa_groups`;

CREATE TABLE `yovo_tbl_aiqa_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` text,
  `permissions` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;

/*Data for the table `yovo_tbl_aiqa_groups` */

insert  into `yovo_tbl_aiqa_groups`(`id`,`name`,`description`,`permissions`,`created_at`,`updated_at`) values 
(1,'Admin','Full system access','{\"users\": {\"read\": true, \"write\": true}, \"agents\": {\"read\": true, \"write\": true}, \"groups\": {\"read\": true, \"write\": true}, \"exports\": {\"read\": true}, \"criteria\": {\"read\": true, \"write\": true}, \"qa-forms\": {\"read\": true, \"admin\": true, \"write\": true}, \"settings\": {\"read\": true, \"write\": true}, \"dashboard\": {\"read\": true, \"write\": true}, \"evaluations\": {\"read\": true, \"write\": true}, \"qa-disputes\": {\"read\": true, \"write\": true}, \"trend-analysis\": {\"read\": true}, \"agent-comparison\": {\"read\": true}}','2025-01-01 23:14:53','2025-04-19 00:00:16'),
(2,'Agent','Standard agent access','{\"users\": {\"read\": false, \"write\": false}, \"agents\": {\"read\": false, \"write\": false}, \"groups\": {\"read\": false, \"write\": false}, \"exports\": {\"read\": true}, \"criteria\": {\"read\": false, \"write\": false}, \"qa-forms\": {\"read\": false, \"write\": false}, \"settings\": {\"read\": false, \"write\": false}, \"dashboard\": {\"read\": true}, \"evaluations\": {\"read\": true, \"write\": true}, \"qa-disputes\": {\"read\": true, \"write\": true}, \"trend-analysis\": {\"read\": true}, \"agent-comparison\": {\"read\": true}}','2025-01-01 23:14:53','2025-04-19 00:00:21');

/*Table structure for table `yovo_tbl_aiqa_users_groups` */

DROP TABLE IF EXISTS `yovo_tbl_aiqa_users_groups`;

CREATE TABLE `yovo_tbl_aiqa_users_groups` (
  `user_id` int NOT NULL,
  `group_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`group_id`),
  KEY `group_id` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

/*Data for the table `yovo_tbl_aiqa_users_groups` */

insert  into `yovo_tbl_aiqa_users_groups`(`user_id`,`group_id`,`created_at`) values 
(1,1,'2025-01-02 14:15:12');

CREATE TABLE `yovo_tbl_token_blacklist` (
  `token_id` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`token_id`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `yovo_tbl_user_logins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_id` varchar(255) NOT NULL,
  `fingerprint` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `is_revoked` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_token` (`token_id`),
  KEY `idx_user_token` (`user_id`,`token_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;

ALTER TABLE yovo_tbl_users MODIFY COLUMN last_login VARCHAR(50);

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
