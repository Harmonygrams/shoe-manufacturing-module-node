"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRouter = void 0;
const express_1 = __importDefault(require("express"));
const controller_1 = require("./controller");
const router = express_1.default.Router();
exports.productRouter = router;
router
    .post('/', controller_1.addProduct)
    .get('/', controller_1.getProducts)
    .get('/:id', controller_1.getProduct)
    .put('/:id', controller_1.updateProduct)
    .delete('/:id', controller_1.deleteProduct);
