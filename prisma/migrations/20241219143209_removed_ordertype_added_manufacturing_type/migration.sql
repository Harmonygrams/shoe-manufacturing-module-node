/*
  Warnings:

  - You are about to drop the column `order_type` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Transaction` DROP COLUMN `order_type`,
    MODIFY `transaction_type` ENUM('purchase', 'sale', 'manufacturing', 'adjustment', 'opening_stock', 'production') NOT NULL;
