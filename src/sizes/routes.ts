import express, { Router } from 'express'
const router : Router = express.Router(); 
import { addSize, getSize, getSizes, updateSize, deleteSize } from './controllers';

router
    .post('/', addSize)
    .get('/', getSizes)
    .get('/:id', getSize)
    .put('/:id', updateSize)
    .delete('/:id', deleteSize)

export { router as sizeRouter };