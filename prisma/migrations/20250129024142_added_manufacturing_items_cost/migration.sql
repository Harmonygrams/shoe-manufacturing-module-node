/*
  Warnings:

  - You are about to drop the column `transaction_id` on the `ManufacturingCost` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `ManufacturingCost` DROP FOREIGN KEY `ManufacturingCost_transaction_id_fkey`;

-- AlterTable
ALTER TABLE `ManufacturingCost` DROP COLUMN `transaction_id`;

-- CreateTable
CREATE TABLE `ManufacturingCostItems` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cost` DECIMAL(65, 30) NOT NULL DEFAULT 0.0,
    `manufacturing_cost_id` INTEGER NULL,
    `transaction_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ManufacturingCostItems` ADD CONSTRAINT `ManufacturingCostItems_manufacturing_cost_id_fkey` FOREIGN KEY (`manufacturing_cost_id`) REFERENCES `ManufacturingCost`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ManufacturingCostItems` ADD CONSTRAINT `ManufacturingCostItems_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
