import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  url: string = '';
  scrapedContent: string = '';
  downloadedImages: string[] = [];
  scrapeSuccess: boolean = false;
  clipboardMessage: string = '';
  loading: boolean = false;

  private http = inject(HttpClient);
  private clipboard = inject(Clipboard);

  scrapeWebsite() {
    this.loading = true;
    this.http.post<any>('http://localhost:3000/scrape', { url: this.url }).subscribe(
      (response) => {
        this.scrapedContent = response.content;
        this.downloadedImages = response.images;
        this.scrapeSuccess = true;
        this.clipboardMessage = 'Scraping completed';
        this.loading = false;
      },
      (error) => {
        console.error('Error:', error);
        this.scrapeSuccess = false;
        this.clipboardMessage = 'Error occurred while scraping';
        this.loading = false;
      }
    );
  }

  copyHtmlToClipboard() {
    this.clipboard.copy(this.scrapedContent);
    this.clipboardMessage = 'HTML copied to clipboard';
  }

  downloadAllImages() {
    const downloadPromises = this.downloadedImages.map(imageName =>
      this.http.get(`http://localhost:3000/downloads/${imageName}`, { responseType: 'blob' })
        .toPromise()
        .then(blob => {
          if (blob) {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = imageName;
            link.click();
            window.URL.revokeObjectURL(url);
          } else {
            console.error(`Failed to download ${imageName}: Blob is undefined`);
          }
        })
    );

    Promise.all(downloadPromises).then(() => {
      this.http.post('http://localhost:3000/delete-images', { images: this.downloadedImages })
        .subscribe(
          () => {
            console.log('Images deleted from server');
            this.downloadedImages = [];
          },
          error => console.error('Error deleting images:', error)
        );
    });
  }
}
