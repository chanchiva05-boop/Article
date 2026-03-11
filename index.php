<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<title>TEVA Lesson Library</title>

<style>

body{
font-family:Arial;
background:#eef2f7;
text-align:center;
}

.container{
background:white;
width:500px;
margin:auto;
margin-top:40px;
padding:25px;
border-radius:12px;
box-shadow:0 5px 15px rgba(0,0,0,0.1);
}

input{
padding:8px;
margin:5px;
}

button{
padding:8px 15px;
background:#007bff;
color:white;
border:none;
border-radius:5px;
cursor:pointer;
}

button:hover{
background:#0056b3;
}

.file{
background:#f7f7f7;
padding:10px;
margin:8px;
border-radius:6px;
}

a{
text-decoration:none;
}

.delete{
color:red;
margin-left:10px;
}

</style>

</head>

<body>

<div class="container">

<h2>📚 TEVA Lesson Upload</h2>

<form action="upload.php" method="POST" enctype="multipart/form-data">

<input type="password" name="password" placeholder="Upload Password" required>
<br>

<input type="file" name="file" required>
<br>

<button type="submit">Upload</button>

</form>

<h3>Files មេរៀន</h3>

<?php

$folder = "uploads/";

$files = scandir($folder);

foreach($files as $file){

if($file != "." && $file != ".."){

echo "<div class='file'>
<a href='uploads/$file' target='_blank'>$file</a>
<a class='delete' href='delete.php?file=$file'>Delete</a>
</div>";

}

}

?>

</div>

</body>
</html>