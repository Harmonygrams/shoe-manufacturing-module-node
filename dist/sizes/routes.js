"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeRouter = void 0;
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
exports.sizeRouter = router;
const controllers_1 = require("./controllers");
router
    .post('/', controllers_1.addSize)
    .get('/', controllers_1.getSizes)
    .get('/:id', controllers_1.getSize)
    .put('/:id', controllers_1.updateSize)
    .delete('/:id', controllers_1.deleteSize);
