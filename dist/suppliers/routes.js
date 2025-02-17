"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierRouter = void 0;
const express_1 = __importDefault(require("express"));
const controllers_1 = require("./controllers");
const router = express_1.default.Router();
exports.supplierRouter = router;
router
    .post('/', controllers_1.addSupplier)
    .get('/', controllers_1.getSuppliers)
    .get('/:id', controllers_1.getSupplier);
