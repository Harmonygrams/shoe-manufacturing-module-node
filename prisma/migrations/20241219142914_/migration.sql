/*
  Warnings:

  - The values [delivery] on the enum `Transaction_manufacturing_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `order_type` VARCHAR(191) NULL,
    MODIFY `manufacturing_status` ENUM('cutting', 'sticking', 'lasting', 'finished') NULL;
