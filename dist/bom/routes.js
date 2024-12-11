"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bomRouter = void 0;
const express_1 = __importDefault(require("express"));
const controllerts_1 = require("./controllerts");
const router = express_1.default.Router();
exports.bomRouter = router;
router
    .post('/', controllerts_1.addBillOfMaterial) // Create new bom
    .get('/', controllerts_1.getBillsOfMaterial)
    .get('/:id', controllerts_1.getBillOfMaterial);
