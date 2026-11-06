import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { ICodeGraph } from '@devscape/shared';

@Injectable({ providedIn: 'root' })
export class CodeGraphService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/parse';

  parse(directoryPath: string): Observable<ICodeGraph> {
    return this.http.post<ICodeGraph>(this.apiUrl, { directoryPath });
  }

  parseDirectory(directoryPath: string): Observable<ICodeGraph> {
    return this.parse(directoryPath);
  }
}

