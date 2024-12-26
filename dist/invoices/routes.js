"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceRouter = void 0;
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
exports.invoiceRouter = router;
const controllers_1 = require("./controllers");
router
    .post('/', controllers_1.addInvoice)
    .get('/', controllers_1.getInvoices)
    .get('/:id', controllers_1.getInvoice)
    .delete('/:id', controllers_1.deleteInvoice);
