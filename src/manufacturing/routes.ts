import express, { Router } from 'express';
import { addProduction, getProductions, getProduction} from './controllers';

const router : Router = express.Router(); 

router
    .post('/', addProduction)
    .get('/', getProductions)
    .get('/:id', getProduction)

export { router as manufacturingRoutes }