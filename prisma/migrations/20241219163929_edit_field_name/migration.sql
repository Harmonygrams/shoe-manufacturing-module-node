/*
  Warnings:

  - The values [fullfilled] on the enum `Transaction_sale_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Transaction` MODIFY `sale_status` ENUM('pending', 'processing', 'fulfilled') NULL;
