<?php
// GET /endpoints/sesion.php
// Le permite al frontend saber si su token sigue siendo válido al cargar la
// página, sin tener que pedir datos de verdad para averiguarlo.
// Si el token no sirve, `ejecutar` responde 401 antes de llegar aquí.

require_once __DIR__ . '/../config/api.php';

ejecutar(fn(): array => ['activa' => true]);
