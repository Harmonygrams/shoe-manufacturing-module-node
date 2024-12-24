-- AlterTable
ALTER TABLE `Transaction` MODIFY `transaction_type` ENUM('purchase', 'sale', 'manufacturing', 'adjustment', 'opening_stock', 'production', 'bom') NOT NULL;
