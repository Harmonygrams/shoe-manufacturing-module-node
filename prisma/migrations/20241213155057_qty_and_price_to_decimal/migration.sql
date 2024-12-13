/*
  Warnings:

  - You are about to alter the column `quantity` on the `BillOfMaterials` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(65,30)`.
  - You are about to alter the column `quantity` on the `BillOfMaterialsList` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(65,30)`.
  - You are about to alter the column `cost` on the `ManufacturingCostTransaction` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(65,30)`.
  - You are about to alter the column `selling_price` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(65,30)`.
  - You are about to alter the column `quantity` on the `TransactionItems` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(65,30)`.
  - You are about to alter the column `remaining_quantity` on the `TransactionItems` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(65,30)`.
  - You are about to alter the column `cost` on the `TransactionItems` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(65,30)`.
  - Made the column `reorder_point` on table `RawMaterials` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `BillOfMaterials` MODIFY `quantity` DECIMAL(65, 30) NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE `BillOfMaterialsList` MODIFY `quantity` DECIMAL(65, 30) NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE `ManufacturingCostTransaction` MODIFY `cost` DECIMAL(65, 30) NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE `Product` MODIFY `selling_price` DECIMAL(65, 30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `RawMaterials` MODIFY `reorder_point` DECIMAL(65, 30) NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE `TransactionItems` MODIFY `quantity` DECIMAL(65, 30) NOT NULL DEFAULT 0.0,
    MODIFY `remaining_quantity` DECIMAL(65, 30) NOT NULL DEFAULT 0.0,
    MODIFY `cost` DECIMAL(65, 30) NOT NULL DEFAULT 0.0;
