"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseRouter = void 0;
const express_1 = __importDefault(require("express"));
const controllers_1 = require("./controllers");
const router = express_1.default.Router();
exports.purchaseRouter = router;
router
    .post('/', controllers_1.addPurchase)
    .get('/', controllers_1.getPurchases)
    .get('/:id', controllers_1.getPurchase)
    .put('/:id', controllers_1.editPurchase)
    .delete('/:id', controllers_1.deletePurchase);
