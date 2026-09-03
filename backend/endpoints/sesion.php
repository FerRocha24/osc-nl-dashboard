<?php
// GET /endpoints/sesion.php
// Datos de la sesión en curso. Le permite al frontend saber quién entró y con
// qué rol al recargar la página, sin volver a pedir credenciales.
// Si el token no sirve, `ejecutar` responde 401 antes de llegar aquí.

require_once __DIR__ . '/../config/api.php';

ejecutar(fn(): array => ['activa' => true] + sesionActual());
