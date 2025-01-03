"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manufacturingCostRouter = void 0;
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
exports.manufacturingCostRouter = router;
const controllers_1 = require("./controllers");
router
    .post('/', controllers_1.addManufacturingCost)
    .get('/', controllers_1.getManufacturingCosts)
    .put('/:id', controllers_1.editManufacturingCost)
    .delete('/:id', controllers_1.deleteManufacturingCost);
