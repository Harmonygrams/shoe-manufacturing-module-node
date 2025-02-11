-- DropForeignKey
ALTER TABLE `ManufacturingCostItems` DROP FOREIGN KEY `ManufacturingCostItems_transaction_id_fkey`;

-- DropForeignKey
ALTER TABLE `TransactionItems` DROP FOREIGN KEY `TransactionItems_transaction_id_fkey`;

-- AddForeignKey
ALTER TABLE `ManufacturingCostItems` ADD CONSTRAINT `ManufacturingCostItems_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionItems` ADD CONSTRAINT `TransactionItems_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
