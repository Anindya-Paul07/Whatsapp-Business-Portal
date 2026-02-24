CREATE DATABASE IF NOT EXISTS whatsapp_platform;
CREATE USER IF NOT EXISTS 'whatsapp_user'@'localhost' IDENTIFIED BY 'whatsapp_pass';
GRANT ALL PRIVILEGES ON whatsapp_platform.* TO 'whatsapp_user'@'localhost';
FLUSH PRIVILEGES;
