/*
  Warnings:

  - The values [finishing] on the enum `Transaction_manufacturing_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Transaction` MODIFY `manufacturing_status` ENUM('cutting', 'sticking', 'lasting', 'finished', 'delivery') NULL;

-- AlterTable
ALTER TABLE `TransactionItems` ADD COLUMN `pending_quantity` DECIMAL(65, 30) NOT NULL DEFAULT 0.0;
