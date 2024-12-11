import express, { Router } from 'express';
import { addProduction } from './controllers';

const router : Router = express.Router(); 

router.post('/', addProduction)

export { router as productionRouter }