"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.validateSchema = {
    idField: function (fieldName) {
        return joi_1.default.number().required().messages({ 'any.required': `Please specify ${fieldName}`, 'number.base': `Please specify ${fieldName}` });
    },
    nameField: function (fieldName) {
        return joi_1.default.string().required().messages({ 'any.required': `Please specify ${fieldName}`, 'number.base': `Please specify ${fieldName}` });
    },
    allowZeroQuantity: function () {
        return joi_1.default.number().min(0).required().messages({ 'any.required': `Quantity must be equal or greater than 0`, 'number.base': `Quantity must be equal or greater than 0`, 'number.min': `Quantity must be equal or greater than 0` });
    },
    quantity: function () {
        return joi_1.default.number().min(1).required().messages({ 'any.required': `Quantity must be equal or greater than 1`, 'number.base': `Quantity must be equal or greater than 1`, 'number.min': `Quantity must be equal or greater than 1` });
    },
    cost: function () {
        return joi_1.default.number().precision(2).min(0).required().messages({ 'number.min': 'Cost price must be equal or greater than 0', 'number.precision': "Invalid cost price", 'any.required': "Cost price required", 'number.base': 'Invalid cost price' });
    },
    arrayField: function (fieldName) {
        return joi_1.default.array().min(1).required().messages({ 'array.base': `Please select at least one ${fieldName}`, 'any.required': `Please select at least one ${fieldName}`, 'array.min': `Please select at least one ${fieldName}` });
    },
    dateField: function (fieldName) {
        return joi_1.default.date().default(new Date()).messages({ 'any.required': `Please specify a ${fieldName}` });
    }
};
