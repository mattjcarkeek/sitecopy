import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import axios from 'axios';

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
  imageUrls: string[] = [];
  scrapeSuccess: boolean = false;
  clipboardMessage: string = '';
  loading: boolean = false;

  private http = inject(HttpClient);
  private clipboard = inject(Clipboard);

  async scrapeWebsite() {
    this.loading = true;
    try {
      const response = await axios.get(`https://corsproxy.io/?${encodeURIComponent(this.url)}`, {
        headers: {
          'Accept': 'text/html'
        }
      });
      
      const html = response.data;
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const mainContent = doc.querySelector('main');
      if (mainContent) {
        const h1Content = mainContent.querySelector('h1.post-title')?.outerHTML || '';
        const articleContent = mainContent.querySelector('article')?.innerHTML || '';
        
        let combinedContent = h1Content + articleContent;
        
        // Text replacement
        combinedContent = combinedContent.replace(/\b(?<!Manage My )Nightlife\b/g, "AMS Nightlife");
        
        this.scrapedContent = combinedContent;
        
        // Extract main image
        const mainImage = mainContent.querySelector('img.wp-post-image') || 
                          mainContent.querySelector('article img') ||
                          doc.querySelector('img');

        let mainImageSrc = '';
        if (mainImage) {
          const src = mainImage.getAttribute('src') || mainImage.getAttribute('data-src');
          if (src && src.startsWith('http')) {
            mainImageSrc = src;
            console.log(`Found main image: ${src}`);
          } else {
            console.log('Main image found but src is invalid');
          }
        } else {
          console.log('No main image found');
        }

        // Extract other images
        const figureImages = Array.from(mainContent.querySelectorAll('figure img')).map(img => 
          img.getAttribute('data-src') || img.getAttribute('src') || ''
        );

        // Create a Set to store unique image URLs
        const uniqueImageUrls = new Set<string>();

        // Add main image if it exists
        if (mainImageSrc) {
          uniqueImageUrls.add(mainImageSrc);
        }

        // Add figure images
        figureImages.forEach(src => {
          if (src.startsWith('http')) {
            uniqueImageUrls.add(src);
          }
        });

        // Convert Set to Array and apply CORS proxy
        this.imageUrls = Array.from(uniqueImageUrls)
          .map(src => `https://corsproxy.io/?${encodeURIComponent(src)}`);

        console.log(`Found ${this.imageUrls.length} unique valid images in total`);
      } else {
        throw new Error('Main content not found');
      }
      
      this.scrapeSuccess = true;
      this.clipboardMessage = 'Scraping completed';
    } catch (error) {
      console.error('Error:', error);
      this.scrapeSuccess = false;
      this.clipboardMessage = 'Error occurred while scraping';
    } finally {
      this.loading = false;
    }
  }

  copyHtmlToClipboard() {
    this.clipboard.copy(this.scrapedContent);
    this.clipboardMessage = 'HTML copied to clipboard';
  }

  downloadAllImages() {
    this.imageUrls.forEach((url) => {
      fetch(url)
        .then(response => response.blob())
        .then(blob => {
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          
          // Extract filename from URL
          const decodedUrl = decodeURIComponent(url);
          const filename = decodedUrl.substring(decodedUrl.lastIndexOf('/') + 1);
          link.download = filename;
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        });
    });
  }
}
