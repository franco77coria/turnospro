-- La lista de espera solicita email obligatorio. El teléfono queda opcional
-- para filas históricas y para el caso de contacto manual del negocio.
ALTER TABLE waitlist ALTER COLUMN client_phone DROP NOT NULL;
-- Las entradas históricas pueden no tener email; no se fuerzan ni se borran.
