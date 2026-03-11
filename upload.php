<?php

$password = "teva8549";

if($_POST["password"] != $password){

echo "Wrong Password";
exit();

}

$folder = "uploads/";

$fileName = $_FILES["file"]["name"];
$tempName = $_FILES["file"]["tmp_name"];

move_uploaded_file($tempName,$folder.$fileName);

header("Location: index.php");

?>