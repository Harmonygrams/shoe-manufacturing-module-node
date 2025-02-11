"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manufacturingRoutes = void 0;
const express_1 = __importDefault(require("express"));
const controllers_1 = require("./controllers");
const router = express_1.default.Router();
exports.manufacturingRoutes = router;
router
    .post('/', controllers_1.addProduction)
    .get('/', controllers_1.getProductions)
    .get('/:id', controllers_1.getProduction)
    .get('/update-metadata/:id', controllers_1.updateProductionStatusMetadata)
    .put('/update-metadata/:id', controllers_1.updateProductionStatus)
    .delete('/:id', controllers_1.deleteProduction);
