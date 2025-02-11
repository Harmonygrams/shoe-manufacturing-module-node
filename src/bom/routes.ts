import express from 'express';
import { addBillOfMaterial, getBillsOfMaterial, getBillOfMaterial, deleteBillOfMaterial, editBillOfMaterial } from './controller'; 
const router = express.Router(); 

router
    .post('/', addBillOfMaterial)           // Create new bom
    .get('/', getBillsOfMaterial)
    .get('/:id', getBillOfMaterial)
    .put('/:id', editBillOfMaterial)
    .delete('/:id', deleteBillOfMaterial)

export { router as bomRouter }