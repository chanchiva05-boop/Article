<?php

$file = $_GET["file"];

$path = "uploads/".$file;

if(file_exists($path)){

unlink($path);

}

header("Location: index.php");

?>