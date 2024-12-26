"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addManufacturingCost = addManufacturingCost;
exports.editManufacturingCost = editManufacturingCost;
exports.deleteManufacturingCost = deleteManufacturingCost;
exports.getManufacturingCosts = getManufacturingCosts;
const prisma_1 = require("../lib/prisma");
const schema_1 = require("../configs/schema");
const joi_1 = __importDefault(require("joi"));
const manufacturingCostSchema = joi_1.default.object({
    name: joi_1.default.string().required().messages({
        'string.empty': 'Cost name is required',
        'any.required': 'Cost name is required'
    }),
    amount: schema_1.validateSchema.cost(),
});
function addManufacturingCost(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = manufacturingCostSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { name, amount } = value;
            // Check if cost name already exists
            const existingCost = yield prisma_1.prisma.manufacturingCost.findFirst({
                where: {
                    name: {
                        equals: name,
                    }
                }
            });
            if (existingCost) {
                res.status(400).json({ message: 'Manufacturing cost name already exists' });
                return;
            }
            const newCost = yield prisma_1.prisma.manufacturingCost.create({
                data: {
                    name,
                    cost: amount,
                }
            });
            res.status(201).json({
                message: 'Manufacturing cost added successfully',
                cost: newCost
            });
        }
        catch (err) {
            console.error('Error in addManufacturingCost:', err);
            res.status(500).json({ message: 'Failed to add manufacturing cost' });
        }
    });
}
function editManufacturingCost(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { error, value } = manufacturingCostSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid cost ID' });
                return;
            }
            const { name, amount } = value;
            // Check if the cost exists
            const existingCost = yield prisma_1.prisma.manufacturingCost.findUnique({
                where: { id: Number(id) }
            });
            if (!existingCost) {
                res.status(404).json({ message: 'Manufacturing cost not found' });
                return;
            }
            // Check for name conflicts (excluding current cost)
            const nameConflict = yield prisma_1.prisma.manufacturingCost.findFirst({
                where: {
                    name,
                    id: {
                        not: Number(id)
                    }
                }
            });
            if (nameConflict) {
                res.status(400).json({ message: 'Manufacturing cost name already exists' });
                return;
            }
            const updatedCost = yield prisma_1.prisma.manufacturingCost.update({
                where: { id: Number(id) },
                data: { name, cost: amount }
            });
            res.status(200).json({
                message: 'Manufacturing cost updated successfully',
                cost: updatedCost
            });
        }
        catch (err) {
            console.error('Error in editManufacturingCost:', err);
            res.status(500).json({ message: 'Failed to update manufacturing cost' });
        }
    });
}
function deleteManufacturingCost(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid cost ID' });
                return;
            }
            // Check if cost exists and is being used in any transactions
            const cost = yield prisma_1.prisma.manufacturingCost.findUnique({
                where: { id: Number(id) },
                include: {
                    transactions: {}
                }
            });
            if (!cost) {
                res.status(404).json({ message: 'Manufacturing cost not found' });
                return;
            }
            if (cost.transactions && cost.transactions) {
                res.status(400).json({
                    message: 'Cannot delete manufacturing cost that has been used in transactions'
                });
                return;
            }
            yield prisma_1.prisma.manufacturingCost.delete({
                where: { id: Number(id) }
            });
            res.status(200).json({ message: 'Manufacturing cost deleted successfully' });
        }
        catch (err) {
            console.error('Error in deleteManufacturingCost:', err);
            res.status(500).json({ message: 'Failed to delete manufacturing cost' });
        }
    });
}
function getManufacturingCosts(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const costs = yield prisma_1.prisma.manufacturingCost.findMany({
                select: {
                    id: true,
                    name: true,
                    cost: true,
                },
                orderBy: {
                    name: 'asc'
                }
            });
            const processedCosts = costs.map(cost => ({
                name: cost.name,
                amount: cost.cost,
                id: cost.id
            }));
            res.status(200).json(processedCosts);
        }
        catch (err) {
            console.error('Error in getManufacturingCosts:', err);
            res.status(500).json({ message: 'Failed to fetch manufacturing costs' });
        }
    });
}
