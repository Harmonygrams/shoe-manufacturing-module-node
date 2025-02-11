import express, { Router } from 'express'; 
import { addMaterial, getMaterial, getMaterials, updateMaterial, deleteMaterial } from './controllers';

const router : Router = express.Router();
router
    .post('/', addMaterial) 
    .get('/', getMaterials)
    .get('/:id', getMaterial)
    .put('/:id', updateMaterial)
    .delete('/:id', deleteMaterial)

export { router as materialRouter }