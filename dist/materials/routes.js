"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.materialRouter = void 0;
const express_1 = __importDefault(require("express"));
const controllers_1 = require("./controllers");
const router = express_1.default.Router();
exports.materialRouter = router;
router
    .post('/', controllers_1.addMaterial)
    .get('/', controllers_1.getMaterials)
    .get('/:id', controllers_1.getMaterial)
    .put('/:id', controllers_1.updateMaterial)
    .delete('/:id', controllers_1.deleteMaterial);
