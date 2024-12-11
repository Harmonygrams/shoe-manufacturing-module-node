"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitRouter = void 0;
const express_1 = __importDefault(require("express"));
const controller_1 = require("./controller");
const router = express_1.default.Router();
exports.unitRouter = router;
// Routes
router
    .post('/', controller_1.addUnit)
    .get('/', controller_1.getUnits)
    .get('/:id', controller_1.getUnit)
    .put('/:id', controller_1.updateUnit)
    .delete('/:id', controller_1.deleteUnit);
