import express from 'express';
import { addBillOfMaterial, getBillsOfMaterial, getBillOfMaterial } from './controllerts'; 
const router = express.Router(); 

router
    .post('/', addBillOfMaterial)           // Create new bom
    .get('/', getBillsOfMaterial)
    .get('/:id', getBillOfMaterial)

export { router as bomRouter }