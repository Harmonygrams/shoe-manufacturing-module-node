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
exports.addUnit = addUnit;
exports.getUnit = getUnit;
exports.getUnits = getUnits;
exports.updateUnit = updateUnit;
exports.deleteUnit = deleteUnit;
const joi_1 = __importDefault(require("joi"));
const prisma_1 = require("../lib/prisma");
const schema_1 = require("../configs/schema");
const unitSchema = joi_1.default.object({
    name: schema_1.validateSchema.nameField('Unit name'),
    symbol: joi_1.default.string().required(),
    description: joi_1.default.string().allow(''),
});
const updateUnitSchema = joi_1.default.object({
    name: joi_1.default.string(),
    description: joi_1.default.string().allow(''),
    symbol: joi_1.default.string()
}).min(1); // At least one field must be provided
// Functions
function addUnit(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = unitSchema.validate(req.body);
            if (error) {
                res.status(400).json({ error: error.details[0].message });
                return;
            }
            const { name, description, symbol } = value;
            const unit = yield prisma_1.prisma.unit.create({
                data: {
                    name,
                    description,
                    symbol
                }
            });
            res.status(201).json({ message: "Unit added successfully" });
            return;
        }
        catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
    });
}
function getUnit(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const unit = yield prisma_1.prisma.unit.findUnique({
                where: { id: parseInt(id) },
                include: {
                    rawMaterials: true,
                    products: true
                }
            });
            if (!unit) {
                res.status(404).json({ error: 'Unit not found' });
                return;
            }
            res.status(200).json(unit);
            return;
        }
        catch (error) {
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
    });
}
function getUnits(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const units = yield prisma_1.prisma.unit.findMany({
                include: {
                    rawMaterials: true,
                    products: true
                }
            });
            res.status(200).json(units);
            return;
        }
        catch (error) {
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
    });
}
function updateUnit(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { error, value } = updateUnitSchema.validate(req.body);
            if (error) {
                res.status(400).json({ error: error.details[0].message });
                return;
            }
            const unit = yield prisma_1.prisma.unit.update({
                where: { id: parseInt(id) },
                data: value
            });
            res.status(200).json(unit);
            return;
        }
        catch (error) {
            if (error.code === 'P2025') {
                res.status(404).json({ error: 'Unit not found' });
                return;
            }
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
    });
}
function deleteUnit(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            yield prisma_1.prisma.unit.delete({
                where: { id: parseInt(id) }
            });
            res.status(204).send();
            return;
        }
        catch (error) {
            if (error.code === 'P2025') {
                res.status(404).json({ error: 'Unit not found' });
                return;
            }
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
    });
}
