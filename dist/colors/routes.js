"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.colorRouter = void 0;
const express_1 = __importDefault(require("express"));
const controllers_1 = require("./controllers");
const router = express_1.default.Router();
exports.colorRouter = router;
router
    .post('/', controllers_1.addColor)
    .get('/', controllers_1.getColors)
    .get('/:id', controllers_1.getColor)
    .put('/:id', controllers_1.updateColor)
    .delete('/:id', controllers_1.deleteColor);
