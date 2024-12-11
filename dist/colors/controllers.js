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
exports.addColor = addColor;
exports.getColor = getColor;
exports.getColors = getColors;
exports.updateColor = updateColor;
exports.deleteColor = deleteColor;
const prisma_1 = require("../lib/prisma");
const joi_1 = __importDefault(require("joi"));
const colorSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
});
function addColor(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = colorSchema.validate(req.body);
            if (error) {
                res.status(400).json(error.details[0].message);
                return;
            }
            const { name } = value;
            yield prisma_1.prisma.color.create({
                data: { name }
            });
            res.status(201).json({ message: 'Color added successfully' });
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function getColor(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const color = yield prisma_1.prisma.color.findUnique({
                where: { id: parseInt(id) }
            });
            if (!color) {
                res.status(404).json({ message: "Color not found" });
                return;
            }
            res.status(200).json(color);
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function getColors(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const colors = yield prisma_1.prisma.color.findMany({
                orderBy: { name: 'asc' }
            });
            res.status(200).json(colors);
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function updateColor(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { error, value } = colorSchema.validate(req.body);
            if (error) {
                res.status(400).json(error.details[0].message);
                return;
            }
            const existingColor = yield prisma_1.prisma.color.findUnique({
                where: { id: parseInt(id) }
            });
            if (!existingColor) {
                res.status(404).json({ message: "Color not found" });
                return;
            }
            const { name } = value;
            yield prisma_1.prisma.color.update({
                where: { id: parseInt(id) },
                data: { name }
            });
            res.status(200).json({ message: "Color updated successfully" });
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function deleteColor(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const existingColor = yield prisma_1.prisma.color.findUnique({
                where: { id: parseInt(id) }
            });
            if (!existingColor) {
                res.status(404).json({ message: "Color not found" });
                return;
            }
            yield prisma_1.prisma.color.delete({
                where: { id: parseInt(id) }
            });
            res.status(200).json({ message: "Color deleted successfully" });
        }
        catch (err) {
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
