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
exports.addSize = addSize;
exports.getSize = getSize;
exports.getSizes = getSizes;
exports.updateSize = updateSize;
exports.deleteSize = deleteSize;
const joi_1 = __importDefault(require("joi"));
const prisma_1 = require("../lib/prisma");
const sizeSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
});
function addSize(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validate the product added
            const { error, value } = sizeSchema.validate(req.body);
            if (error) {
                res.status(400).json(error.details[0].message);
                return;
            }
            const { name } = value;
            const addSize = yield prisma_1.prisma.size.create({
                data: {
                    name
                }
            });
            res.status(201).json({ message: 'Size added successfully' });
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function getSize(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const size = yield prisma_1.prisma.size.findUnique({
                where: {
                    id: parseInt(id)
                }
            });
            if (!size) {
                res.status(404).json({ message: "Size not found" });
                return;
            }
            res.status(200).json(size);
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function getSizes(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const sizes = yield prisma_1.prisma.size.findMany({
                orderBy: {
                    name: 'asc'
                }
            });
            res.status(200).json(sizes);
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function updateSize(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            // Validate the update data
            const { error, value } = sizeSchema.validate(req.body);
            if (error) {
                res.status(400).json(error.details[0].message);
                return;
            }
            // Check if size exists
            const existingSize = yield prisma_1.prisma.size.findUnique({
                where: {
                    id: parseInt(id)
                }
            });
            if (!existingSize) {
                res.status(404).json({ message: "Size not found" });
                return;
            }
            const { name } = value;
            const updatedSize = yield prisma_1.prisma.size.update({
                where: {
                    id: parseInt(id)
                },
                data: {
                    name
                }
            });
            res.status(200).json({ message: "Size updated successfully" });
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function deleteSize(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            // Check if size exists
            const existingSize = yield prisma_1.prisma.size.findUnique({
                where: {
                    id: parseInt(id)
                }
            });
            if (!existingSize) {
                res.status(404).json({ message: "Size not found" });
                return;
            }
            yield prisma_1.prisma.size.delete({
                where: {
                    id: parseInt(id)
                }
            });
            res.status(200).json({ message: "Size deleted successfully" });
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
