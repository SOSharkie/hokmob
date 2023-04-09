
export class ImageUtils {

  public static createImageFromBlob(image: Blob): any {
    let reader = new FileReader();
    reader.addEventListener("load", () => {
      return reader.result;
    }, false);

    if (image) {
      reader.readAsDataURL(image);
    }
  }
}
